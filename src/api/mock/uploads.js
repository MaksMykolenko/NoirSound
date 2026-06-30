export async function uploadTrack() {
  return {
    trackId: `demo-track-${Date.now()}`,
    uploadId: `demo-upload-${Date.now()}`,
  };
}

export async function getUploadStatus() {
  return { status: 'READY', trackStatus: 'PUBLISHED' };
}
