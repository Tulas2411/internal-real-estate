"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, KeyRound, Users, Archive, History, ShieldCheck, LogOut, Menu, X, Plus, House } from "lucide-react";
import { useState } from "react";
import type { UserDTO } from "@/lib/dto";
import { Button } from "./ui/button";
export function Shell({ user, children }: { user: UserDTO; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const nav = [{ href: "/", name: "Tổng quan", icon: LayoutDashboard }, { href: "/rent", name: "Cho thuê", icon: KeyRound }, { href: "/sale", name: "Mua bán", icon: House }];
  const adminNav = [{ href: "/users", name: "Tài khoản", icon: Users }, { href: "/permissions", name: "Phân quyền", icon: ShieldCheck }, { href: "/archived", name: "Đã lưu trữ", icon: Archive }, { href: "/audit", name: "Nhật ký hệ thống", icon: History }];
  return <div className="app-shell"><a className="skip-link" href="#main">Đến nội dung chính</a>{open && <button className="sidebar-backdrop" aria-label="Đóng điều hướng" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? "is-open" : ""}`}><Link className="brand" href="/"><span className="brand-icon"><Building2 /></span><span>nhà<span className="brand-dot">.</span><small>NỘI BỘ</small></span></Link><button className="mobile-close" aria-label="Đóng menu" onClick={() => setOpen(false)}><X /></button>
      <div className="workspace-tag"><span className="status-dot" />Không gian nội bộ</div>
      <p className="nav-label">KHO BẤT ĐỘNG SẢN</p><nav>{nav.map(item => <Link onClick={() => setOpen(false)} aria-current={path === item.href ? "page" : undefined} className={path === item.href ? "nav-link active" : "nav-link"} key={item.href} href={item.href}><item.icon size={19} />{item.name}</Link>)}</nav>
      {user.role === "ADMIN" && <><p className="nav-label">QUẢN TRỊ</p><nav>{adminNav.map(item => <Link onClick={() => setOpen(false)} aria-current={path === item.href ? "page" : undefined} className={path === item.href ? "nav-link active" : "nav-link"} key={item.href} href={item.href}><item.icon size={19} />{item.name}</Link>)}</nav></>}
      <div className="sidebar-bottom"><div className="privacy-note"><ShieldCheck size={20} /><p>Dữ liệu riêng tư<small>Chỉ chia sẻ trong đội ngũ</small></p></div><Link className="user-card" href="/password"><span className="avatar">{user.name.slice(0, 1)}</span><span>{user.name}<small>{user.role === "ADMIN" ? "Quản trị viên" : "Thành viên"}</small></span></Link><button className="logout" onClick={async () => { const r = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (r.ok) window.location.assign("/login"); }}><LogOut size={16} />Đăng xuất</button></div>
    </aside><div className="main-shell"><header className="topbar"><button className="mobile-menu" aria-label="Mở menu" onClick={() => setOpen(true)}><Menu /></button><div className="breadcrumb">Không gian làm việc <span>/</span> {nav.concat(adminNav).find(x => x.href === path)?.name ?? "Hồ sơ bất động sản"}</div><div className="topbar-right"><span className="team-label"><span className="status-dot" /> Dành cho đội ngũ của bạn</span>{user.role === "ADMIN" && <Button asChild size="sm"><Link href="/properties/new"><Plus size={16} />Thêm hồ sơ</Link></Button>}</div></header><main id="main" className="main-content">{children}</main><footer className="site-footer">Nhà Nội Bộ <span>Thông tin rõ ràng. Kết nối hiệu quả.</span></footer></div>
  </div>;
}
