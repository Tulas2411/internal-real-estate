"use client";
import { useState } from "react";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataForm, mutate } from "./common";
import { passwordSchema } from "@/lib/validation";
export function LoginForm() {
  return <div className="login-screen"><div className="login-story"><div className="brand"><span className="brand-icon"><Building2 /></span><span>nhà.<small>NỘI BỘ</small></span></div><div><p className="eyebrow">MỘT KHO CHUNG. MỌI CƠ HỘI.</p><h1>Đúng thông tin.<br />Đúng bất động sản.<br /><span>Đúng thời điểm.</span></h1><p>Quản lý nguồn hàng và làm việc cùng đội ngũ<br />trong một không gian riêng tư.</p></div><div className="login-trust"><ShieldCheck size={20} />Thông tin được bảo vệ theo quyền truy cập</div></div><main className="login-form-wrap"><div className="login-form"><p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h2>Đăng nhập</h2><p className="muted">Sử dụng tài khoản do quản trị viên cung cấp.</p><DataForm fields={[{ name: "email", label: "Email", type: "email", required: true }, { name: "password", label: "Mật khẩu", type: "password", required: true }]} submitLabel="Đăng nhập →" submit={async values => {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(values.email).toLowerCase().trim(), password: values.password }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.message ?? "Không thể đăng nhập."); }
      const me = await fetch("/api/app/me").then(r => r.json());
      window.location.assign(me.mustChangePassword ? "/password" : "/");
    }} /><p className="login-help">Quên mật khẩu? Liên hệ quản trị viên để được cấp mật khẩu tạm mới.</p></div></main></div>;
}
export function PasswordForm({ required }: { required: boolean }) {
  const [done, setDone] = useState(false);
  return <main className="password-screen"><div className="panel"><ShieldCheck className="accent" size={32} /><h1>{required ? "Đổi mật khẩu tạm" : "Đổi mật khẩu"}</h1><p className="muted">{required ? "Bạn cần đặt mật khẩu mới trước khi truy cập kho. Mật khẩu tạm chỉ đăng nhập được một lần." : "Sau khi đổi mật khẩu, tất cả phiên đăng nhập sẽ kết thúc."}</p>{done ? <div className="success"><p>Đã đổi mật khẩu. Vui lòng đăng nhập lại.</p><Link href="/login">Đến trang đăng nhập <ArrowRight size={16} /></Link></div> : <DataForm fields={[{ name: "currentPassword", label: "Mật khẩu hiện tại", type: "password", required: true }, { name: "newPassword", label: "Mật khẩu mới", type: "password", required: true, hint: "Ít nhất 12 ký tự và khác mật khẩu hiện tại." }]} schema={passwordSchema} submit={v => mutate("password", v)} onDone={() => setDone(true)} submitLabel="Đổi mật khẩu" />}{!required && !done && <Link href="/">← Về tổng quan</Link>}</div></main>;
}
