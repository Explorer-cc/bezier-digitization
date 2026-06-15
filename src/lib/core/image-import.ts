export function isImageFile(file: File | null | undefined): file is File {
	return !!file && file.type.startsWith('image/');
}

export function createClipboardImageFile(blob: Blob, timestamp = Date.now()): File {
	const subtype = blob.type.split('/')[1]?.split(/[;+]/)[0].toLowerCase();
	const extension = subtype === 'jpeg' ? 'jpg' : subtype || 'png';
	return new File([blob], `clipboard-${timestamp}.${extension}`, { type: blob.type });
}
