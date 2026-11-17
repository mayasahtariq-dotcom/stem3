/**
 * PUTs a file to a signed storage link with upload progress (XMLHttpRequest,
 * since fetch has no upload progress). Resolves on 2xx, rejects otherwise, so
 * the caller can never mark a page uploaded that the server didn't accept.
 */
export function putFile(url: string, body: Blob, headers: Record<string, string>, onProgress: (fraction: number) => void, method = "PUT"): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new TypeError("network error during upload"));
    xhr.send(body);
  });
}
