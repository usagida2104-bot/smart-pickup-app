"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useMasterStore } from "@/lib/store/masterStore";
import { Staff } from "@/types";
import { cn } from "@/lib/utils";

const TIME_OPTIONS = Array.from({ length: 13 * 12 + 1 }).map((_, i) => {
  const h = Math.floor(i / 12) + 8;
  const m = (i % 12) * 5;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
});

const getStatusColor = (status?: string) => {
  switch (status) {
    case "absent": return "text-slate-600 bg-slate-100 border-slate-300";
    case "late": return "text-amber-700 bg-amber-50 border-amber-200";
    case "early_leave": return "text-purple-700 bg-purple-50 border-purple-200";
    case "present":
    default: return "text-pink-700 bg-pink-50 border-pink-200";
  }
};

export default function StaffPage() {
  const { staff, vehicles, addStaff, updateStaff, deleteStaff } = useMasterStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    is_driver: true, 
    homeAddress: "", 
    assignedVehicleId: "" as string | null,
    unit_name: "ぽっけ" as string | null,
    role: "一般スタッフ" as string | null
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", is_driver: true, homeAddress: "", assignedVehicleId: null, unit_name: "ぽっけ", role: "一般スタッフ" });
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ 
      name: s.name, 
      is_driver: s.is_driver, 
      homeAddress: s.homeAddress || "", 
      assignedVehicleId: s.assignedVehicleId || null,
      unit_name: s.unit_name || "ぽっけ",
      role: s.role || "一般スタッフ"
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateStaff(editing.id, form);
    } else {
      addStaff({ id: `staff-${Date.now()}`, ...form });
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">スタッフ管理</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">登録スタッフ数: {staff.length}名</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          スタッフを追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">名前</TableHead>
                <TableHead className="whitespace-nowrap">所属 / 役職</TableHead>
                <TableHead className="whitespace-nowrap min-w-[220px]">ステータス</TableHead>
                <TableHead className="whitespace-nowrap">ドライバー</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {s.name}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {s.unit_name && <span className="text-sm font-medium text-gray-700">{s.unit_name}</span>}
                    {s.role && (
                      <Badge 
                        variant={s.role.includes("リーダー") ? "default" : "secondary"}
                        className={cn(
                          "w-max text-[11px] px-2 py-0.5 font-bold",
                          s.role === "ぽっけリーダー" ? "bg-blue-600 hover:bg-blue-600 text-white shadow-sm" :
                          s.role === "ぽっけⅡリーダー" ? "bg-purple-600 hover:bg-purple-600 text-white shadow-sm" :
                          s.role === "日中一時リーダー" ? "bg-orange-500 hover:bg-orange-500 text-white shadow-sm" :
                          "bg-gray-100 text-gray-500 hover:bg-gray-100 font-normal border-gray-200"
                        )}
                      >
                        {s.role}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Select 
                      value={s.status || "present"}
                      onValueChange={(v: "present" | "absent" | "late" | "early_leave") => {
                        updateStaff(s.id, { 
                          status: v, 
                          status_time: (v === "late" || v === "early_leave") ? (s.status_time || "09:00") : null 
                        });
                      }}
                    >
                      <SelectTrigger className={cn("w-[110px] h-8 text-xs font-bold border", getStatusColor(s.status))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present"><span className="text-pink-700 font-bold">出勤</span></SelectItem>
                        <SelectItem value="absent"><span className="text-slate-600 font-bold">休み</span></SelectItem>
                        <SelectItem value="late"><span className="text-amber-700 font-bold">遅刻</span></SelectItem>
                        <SelectItem value="early_leave"><span className="text-purple-700 font-bold">早退</span></SelectItem>
                      </SelectContent>
                    </Select>

                    {(s.status === "late" || s.status === "early_leave") && (
                      <Select
                        value={s.status_time || "09:00"}
                        onValueChange={(v) => updateStaff(s.id, { status_time: v })}
                      >
                        <SelectTrigger className="w-[80px] h-8 text-xs bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map((time) => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.is_driver ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                      🚗 {s.assignedVehicleId ? (vehicles.find(v => v.id === s.assignedVehicleId)?.name || "ドライバー") : "ドライバー"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">アシスタント</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "スタッフを編集" : "スタッフを追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="staff-name">名前 *</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="田中 太郎"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="staff-address">自宅住所</Label>
              <Input
                id="staff-address"
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                placeholder="福島県郡山市..."
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>所属ユニット</Label>
                <Select
                  value={form.unit_name || "ぽっけ"}
                  onValueChange={(v) => {
                    setForm({ ...form, unit_name: v, role: "一般スタッフ" });
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ぽっけ">ぽっけ</SelectItem>
                    <SelectItem value="ぽっけⅡ">ぽっけⅡ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>役職</Label>
                <Select
                  value={form.role || "一般スタッフ"}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="一般スタッフ">一般スタッフ</SelectItem>
                    {form.unit_name === "ぽっけ" && (
                      <>
                        <SelectItem value="ぽっけリーダー">ぽっけリーダー</SelectItem>
                        <SelectItem value="日中一時リーダー">日中一時リーダー</SelectItem>
                      </>
                    )}
                    {form.unit_name === "ぽっけⅡ" && (
                      <SelectItem value="ぽっけⅡリーダー">ぽっけⅡリーダー</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div 
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                form.is_driver 
                  ? "bg-blue-50 border-blue-300 shadow-sm" 
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Switch
                id="is-driver"
                checked={form.is_driver}
                onCheckedChange={(v) => setForm({ ...form, is_driver: v })}
                className={form.is_driver ? "data-[state=checked]:bg-blue-600" : ""}
              />
              <Label 
                htmlFor="is-driver" 
                className={form.is_driver ? "text-blue-700 font-bold" : "text-gray-900"}
              >
                ドライバー権限あり
              </Label>
            </div>
            {form.is_driver && (
              <div>
                <Label>担当車両</Label>
                <Select
                  value={form.assignedVehicleId || "none"}
                  onValueChange={(v) => setForm({ ...form, assignedVehicleId: v === "none" ? null : v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="担当車両を選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">指定なし</SelectItem>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}（定員: {v.capacity}名）</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button 
              onClick={handleSave} 
              disabled={!form.name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 transition-colors shadow-sm"
            >
              {editing ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>削除の確認</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> を削除してよろしいですか？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteTarget) deleteStaff(deleteTarget.id);
              setDeleteTarget(null);
            }}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
