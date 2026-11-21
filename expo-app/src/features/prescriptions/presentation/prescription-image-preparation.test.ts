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
  cropPrescriptionImageToNameBand,
  preparePrescriptionImage,
  prescriptionImageMaximumDimension,
} from './prescription-image-preparation';

function mockNativeImage({ byteSize = 2048, base64 = 'YWJj' }: { byteSize?: number; base64?: string } = {}) {
  const saveAsync = jest.fn(async () => ({ uri: 'file:///cache/ocr-page.jpg', width: 1200, height: 1600 }));
  jest.mocked(ImageManipulator.manipulate).mockReturnValue({
    crop: jest.fn(),
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

  it('crops a user-tapped name band locally without uploading image data', async () => {
    mockNativeImage();
    const original = await preparePrescriptionImage({ uri: 'file:///picker/original.jpg' });
    const cropped = await cropPrescriptionImageToNameBand(original, 0.35);
    expect(ImageManipulator.manipulate).toHaveBeenLastCalledWith(original.uri);
    const calls = jest.mocked(ImageManipulator.manipulate).mock.results;
    const imageContext = calls[calls.length - 1]?.value;
    expect(imageContext.crop).toHaveBeenCalledWith({ originX: 0, originY: 384, width: 1200, height: 352 });
    expect(cropped).toMatchObject({ mimeType: 'image/jpeg', byteSize: 2048 });
    expect(cropped.qualityWarnings.join(' ')).toContain('đầy đủ tên thuốc');
  });

  it('refuses out-of-bounds tap positions before manipulating images', async () => {
    mockNativeImage();
    const original = await preparePrescriptionImage({ uri: 'file:///picker/original.jpg' });
    const count = jest.mocked(ImageManipulator.manipulate).mock.calls.length;
    await expect(cropPrescriptionImageToNameBand(original, 1.5)).rejects.toThrow('Vị trí');
    expect(jest.mocked(ImageManipulator.manipulate).mock.calls).toHaveLength(count);
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
