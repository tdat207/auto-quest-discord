# Discord Auto Quest Bot (MT System Clone)

Hệ thống Bot tự động hóa Discord Quest dành cho máy cá nhân và server bạn bè.

## Cách Sử Dụng:

### 1. Cấu hình Bot Token (Chỉ làm lần đầu)
1. Truy cập [Discord Developer Portal](https://discord.com/developers/applications).
2. Tạo **New Application** -> Vào mục **Bot** -> Bấm **Reset Token** để copy **Bot Token**.
3. Kéo xuống mục **Privileged Gateway Intents**, bật công tắc **Message Content Intent** (bật cả 3 công tắc).
4. Vào **OAuth2** -> **URL Generator**:
   - Scopes: Chọn `bot` và `applications.commands`.
   - Permissions: Chọn `Administrator`.
   - Copy URL ở dưới và mở lên trình duyệt để mời Bot vào Server Discord của bạn.
5. Mở file `config.json` và dán Bot Token vào:
   ```json
   {
     "botToken": "DÁN_BOT_TOKEN_VÀO_ĐÂY"
   }
   ```

### 2. Khởi Động Bot
- Chạy file **`start.bat`**.
- Vào Server Discord, gõ lệnh `!setup` vào kênh chat.
- Bảng điều khiển sẽ hiện ra. Bạn hoặc bạn bè chỉ cần bấm **🚀 Bắt đầu** và dán User Token vào khung pop-up riêng tư để tự động cày tất cả nhiệm vụ cùng lúc!

---
*(Ngoài ra, nếu muốn chạy riêng lẻ 1-click cho riêng bạn mà không cần mở Bot, bạn vẫn có thể bấm đúp vào `chay_nhanh.bat`).*
