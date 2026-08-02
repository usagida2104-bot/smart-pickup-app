"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Child } from "@/types";
import { useMasterStore } from "@/lib/store/masterStore";

const unitOptions = ["ぽっけ1", "ぽっけ2", "日中一時"];

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

export default function ChildrenPage() {
  const { children, schools, addChild, updateChild, deleteChild } = useMasterStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Child | null>(null);

  const defaultForm = {
    name: "",
    school_id: "",
    unit_name: "ぽっけ1",
    has_caution: false,
    notes: "",
    homeAddress: "",
  };
  const [form, setForm] = useState(defaultForm);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (child: Child) => {
    setEditing(child);
    setForm({
      name: child.name,
      school_id: child.school_id ?? "",
      unit_name: child.unit_name ?? "ぽっけ1",
      has_caution: child.has_caution,
      notes: child.notes ?? "",
      homeAddress: child.homeAddress ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateChild(editing.id, form);
    } else {
      addChild({
        id: `child-${Date.now()}`,
        name: form.name,
        school_id: form.school_id || null,
        unit_name: form.unit_name || null,
        has_caution: form.has_caution,
        notes: form.notes || null,
        homeAddress: form.homeAddress || null,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (child: Child) => {
    deleteChild(child.id);
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">児童管理</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">登録児童数: {children.length}名</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          児童を追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">名前</TableHead>
                <TableHead className="whitespace-nowrap min-w-[220px]">ステータス</TableHead>
                <TableHead className="whitespace-nowrap">学校</TableHead>
                <TableHead className="whitespace-nowrap">ユニット</TableHead>
                <TableHead className="whitespace-nowrap">配慮事項</TableHead>
                <TableHead className="whitespace-nowrap">メモ</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {children.map((child) => (
              <TableRow key={child.id} className={cn(
                "hover:bg-gray-50",
                child.has_caution && "bg-green-50 hover:bg-green-100"
              )}>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {child.name}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Select 
                      value={child.status || "present"}
                      onValueChange={(v: "present" | "absent" | "late" | "early_leave") => {
                        updateChild(child.id, { 
                          status: v, 
                          status_time: (v === "late" || v === "early_leave") ? (child.status_time || "14:00") : null 
                        });
                      }}
                    >
                      <SelectTrigger className={cn("w-[110px] h-8 text-xs font-bold border", getStatusColor(child.status))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present"><span className="text-pink-700 font-bold">出席</span></SelectItem>
                        <SelectItem value="absent"><span className="text-slate-600 font-bold">休み</span></SelectItem>
                        <SelectItem value="late"><span className="text-amber-700 font-bold">遅刻</span></SelectItem>
                        <SelectItem value="early_leave"><span className="text-purple-700 font-bold">早退</span></SelectItem>
                      </SelectContent>
                    </Select>

                    {(child.status === "late" || child.status === "early_leave") && (
                      <Select
                        value={child.status_time || "14:00"}
                        onValueChange={(v) => updateChild(child.id, { status_time: v })}
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
                  <Badge variant="outline" className="bg-gray-50">{child.school?.name ?? "未設定"}</Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {child.unit_name ? (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                      {child.unit_name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">未設定</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {child.has_caution ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      配慮あり
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </TableCell>
                <TableCell className="truncate max-w-[150px] whitespace-nowrap">
                  {child.notes || <span className="text-gray-400 text-xs">-</span>}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(child)}
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(child)}
                    >
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "児童を編集" : "児童を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="child-name">名前 *</Label>
              <Input
                id="child-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="山田 太郎"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>学校</Label>
              <Select
                value={form.school_id}
                onValueChange={(v) => setForm({ ...form, school_id: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="学校を選択" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: s.color_code ?? "#ccc" }}
                        />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ユニット</Label>
              <Select
                value={form.unit_name}
                onValueChange={(v) => setForm({ ...form, unit_name: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div 
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                form.has_caution 
                  ? "bg-rose-50 border-rose-300 shadow-sm" 
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <Switch
                id="has-caution"
                checked={form.has_caution}
                onCheckedChange={(v) => setForm({ ...form, has_caution: v })}
                className={form.has_caution ? "data-[state=checked]:bg-rose-500" : ""}
              />
              <Label 
                htmlFor="has-caution" 
                className={form.has_caution ? "text-amber-700 font-bold" : "text-gray-900"}
              >
                配慮事項あり（背景ハイライト）
              </Label>
            </div>
            <div>
              <Label htmlFor="child-address">自宅住所</Label>
              <Input
                id="child-address"
                value={form.homeAddress}
                onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                placeholder="福島県郡山市..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="child-notes">メモ</Label>
              <Input
                id="child-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="特記事項があれば記入"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
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

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>削除の確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> を削除してよろしいですか？この操作は取り消せません。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteChild(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
