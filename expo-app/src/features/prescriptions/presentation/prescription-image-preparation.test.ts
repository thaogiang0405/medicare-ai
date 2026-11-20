/* eslint-disable import/first */

const mockFileBase64 = jest.fn();
const mockFileDelete = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg' },
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
}));

import { File } from 'expo-file-system';
import { ImageManipulator } from 'expo-image-manipulator';

import {
  deleteTemporaryPrescriptionImages,
  preparePrescriptionImage,
  prescriptionImageMaximumDimension,
} from './prescription-image-preparation';

function mockNativeImage({ byteSize = 2048, base64 = 'YWJj' }: { byteSize?: number; base64?: string } = {}) {
  const saveAsync = jest.fn(async () => ({ uri: 'file:///cache/ocr-page.jpg', width: 1200, height: 1600 }));
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({
    renderAsync: jest.fn(async () => ({ saveAsync })),
  } as unknown as ReturnType<typeof ImageManipulator.manipulate>);
  jest.mocked(File).mockImplementation(() => ({
    size: byteSize,
    base64: mockFileBase64.mockResolvedValue(base64),
    exists: true,
    delete: mockFileDelete,
  }) as unknown as File);
}

describe('prescription image preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-encodes a temporary JPEG page with bounded dimensions and transient base64', async () => {
    mockNativeImage();

    const page = await preparePrescriptionImage({ uri: 'file:///picker/original.jpg' });

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///picker/original.jpg', {
      maxWidth: prescriptionImageMaximumDimension,
      maxHeight: prescriptionImageMaximumDimension,
    });
    expect(page).toMatchObject({
      uri: 'file:///cache/ocr-page.jpg',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      width: 1200,
      height: 1600,
      base64: 'YWJj',
    });
  });

  it('rejects a page that remains larger than the upload ceiling after optimization', async () => {
    mockNativeImage({ byteSize: 5 * 1024 * 1024 + 1 });

    await expect(preparePrescriptionImage({ uri: 'file:///picker/large.jpg' })).rejects.toThrow('quá lớn');
    expect(mockFileBase64).not.toHaveBeenCalled();
  });

  it('only deletes app-local file URIs during best-effort cleanup', () => {
    mockNativeImage();

    deleteTemporaryPrescriptionImages([
      { uri: 'file:///cache/ocr-page.jpg' },
      { uri: 'ph://library-original' },
    ]);

    expect(File).toHaveBeenCalledTimes(1);
    expect(mockFileDelete).toHaveBeenCalledTimes(1);
  });
});
