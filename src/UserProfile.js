export default class UserProfile {
  constructor(localKey, defaultName, defaultAvatar) {
    this.localKey = localKey;
    this.defaultName = defaultName || "Kamu";
    this.defaultAvatar = defaultAvatar || "assets/avatar-user.png";
    this.name = this.defaultName;
    this.avatar = this.defaultAvatar;
    this.load();
  }

  load() {
    try {
      const data = JSON.parse(localStorage.getItem(this.localKey));
      if (data) {
        this.name = data.name || this.defaultName;
        this.avatar = data.avatar || this.defaultAvatar;
      }
    } catch (err) {
      console.error("Gagal load profile:", err);
    }
  }

  save() {
    localStorage.setItem(
      this.localKey,
      JSON.stringify({
        name: this.name,
        avatar: this.avatar,
      })
    );
  }

  setName(name) {
    this.name = name || this.defaultName;
    this.save();
  }

  setAvatar(avatarDataUrl) {
    this.avatar = avatarDataUrl || this.defaultAvatar;
    this.save();
  }

  getName() {
    return this.name;
  }

  getAvatar() {
    return this.avatar;
  }
}
