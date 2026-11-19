# ⚡ Discord Autonomous Multi-Quest Bot (24/7 Cloud & Local Edition)

Hệ thống Bot Discord tự động quét và hoàn thành tất cả nhiệm vụ (Game + Video) song song trong 15 phút, hỗ trợ đa người dùng (Multi-Session) và chạy 24/7 trên Cloud.

---

## 🚀 Triển Khai 24/7 Miễn Phí Lên Render.com (Không cần mở máy tính)

1. Đăng nhập vào [Render.com](https://render.com) (chọn Login with GitHub).
2. Chọn **New +** ➔ **Web Service**.
3. Chọn kho lưu trữ **`auto-quest-discord`** từ danh sách GitHub của bạn.
4. Thiết lập các thông số:
   - **Name:** `auto-quest-discord`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Kéo xuống mục **Environment Variables** (Biến môi trường), thêm:
   - **Key:** `BOT_TOKEN`
   - **Value:** `Dán_Bot_Token_Của_Bạn_Vào_Đây`
6. Bấm **Deploy Web Service**.
   - Render sẽ tự động cài đặt và chạy bot vĩnh viễn 24/7.
   - Bot có sẵn máy chủ Health-Check giữ kết nối sống liên tục.

---

## 💻 Hoặc Chạy Trực Tiếp Trên Máy Tính (Local)

1. Mở file `config.json` và điền Bot Token.
2. Bấm đúp file **`start.bat`** để khởi động.

---

## 🎮 Cách Sử Dụng Trong Server Discord

1. Mời Bot vào Server của bạn bằng link OAuth2:
   ```
   https://discord.com/oauth2/authorize?client_id=1573022107757973626&permissions=8&integration_type=0&scope=bot+applications.commands
   ```
2. Trong kênh chat server, gõ:
   ```
   /setup
   ```
3. Bảng điều khiển tương tác sẽ xuất hiện:
   - **🚀 Bắt đầu:** Bật popup riêng tư để người dùng dán User Token. Hệ thống sẽ gửi DM báo cáo chi tiết các quest trước, sau đó cày song song và DM chúc mừng khi chạm 100%.
   - **🔑 Lấy Token:** Nhận hướng dẫn và mã 1 dòng tự copy token trong F12 Console.
   - **📊 Tiến độ:** Xem tiến độ thời gian thực của các quest đang chạy.
   - **⏹ Dừng phiên:** Dừng phiên làm việc hiện tại.
