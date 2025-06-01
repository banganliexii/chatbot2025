export default class FileUpload {
  constructor(options) {
    this.FILE_MAX_SIZE_MB = options.FILE_MAX_SIZE_MB;
    this.FILE_ALLOWED_TYPES = options.FILE_ALLOWED_TYPES;
    this.dom = options.dom;
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

  handleFileUpload(event, onFileReady) {
    const files = event.target.files || [];
    for (let i = 0; i < files.length; i++) {
      const result = this.validate(files[i]);
      if (result.valid) {
        const reader = new FileReader();
        reader.onload = (e) => onFileReady(files[i], e.target.result);
        reader.readAsDataURL(files[i]);
      } else {
        alert(result.reason);
      }
    }
  }
}
