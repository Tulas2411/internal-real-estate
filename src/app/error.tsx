"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="empty"><h1>Chưa thể tải dữ liệu</h1><p>Kiểm tra kết nối và dịch vụ PostgreSQL rồi thử lại.</p><button className="button button-primary" onClick={reset}>Thử lại</button></div>; }
