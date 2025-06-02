// AGENT-13 - FileUpload Class - Versi perbaikan & best practice

export default class FileUpload {
  constructor(options) {
    this.FILE_MAX_SIZE_MB = options.FILE_MAX_SIZE_MB;
    this.FILE_ALLOWED_TYPES = options.FILE_ALLOWED_TYPES;
    this.dom = options.dom;
    this.onError = options.onError || ((msg) => alert(msg)); // bisa custom error handler
    this.onProgress = options.onProgress || null; // opsional: progress bar callback
  }

  validate(file) {
    if (!this.FILE_ALLOWED_TYPES.some((type) => file.type.startsWith(type))) {
      return { valid: false, reason: "Tipe file tidak didukung." };
    }
    if (file.size > this.FILE_MAX_SIZE_MB * 1024 * 1024) {
      return {
        valid: false,
        reason: `Ukuran file terlalu besar! Maksimal ${this.FILE_MAX_SIZE_MB}MB`,
      };
    }
    return { valid: true, reason: "" };
  }

  /**
   * Upload handler: bisa multiple file, bisa progress, bisa custom onError
   * @param {Event} event - input file change event
   * @param {Function} onFileReady - callback(file, content, previewType)
   */
  handleFileUpload(event, onFileReady) {
    const files = event.target.files || [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = this.validate(file);
      if (!result.valid) {
        this.onError(result.reason);
        continue;
      }
      const reader = new FileReader();

      // Progress handler (optional)
      if (this.onProgress) {
        reader.onprogress = (evt) => {
          if (evt.lengthComputable) {
            let percent = Math.round((evt.loaded / evt.total) * 100);
            this.onProgress(percent, file.name);
          }
        };
      }

      reader.onload = (e) => {
        let previewType = "unknown";
        if (file.type.startsWith("image/")) previewType = "image";
        else if (file.type === "application/pdf") previewType = "pdf";
        else if (file.type.startsWith("text/")) previewType = "text";
        onFileReady(file, e.target.result, previewType);
        if (this.onProgress) this.onProgress(100, file.name);
      };

      // Pilih read type berdasarkan file type
      if (file.type.startsWith("image/")) reader.readAsDataURL(file);
      else if (file.type.startsWith("text/")) reader.readAsText(file);
      else if (file.type === "application/pdf") reader.readAsDataURL(file);
      else reader.readAsArrayBuffer(file);
    }
  }
}
