const fs = require('fs');

const content = `"use client";

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

export default function StaffPage() {
  const { staff, addStaff, updateStaff, deleteStaff } = useMasterStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    is_driver: true, 
    homeAddress: "", 
    assignedVehicleId: null as string | null,
    unit_name: "ぽっけ" as string | null,
    role: null as string | null
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", is_driver: true, homeAddress: "", assignedVehicleId: null, unit_name: "ぽっけ", role: null });
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ 
      name: s.name, 
      is_driver: s.is_driver, 
      homeAddress: s.homeAddress || "", 
      assignedVehicleId: null,
      unit_name: s.unit_name || "ぽっけ",
      role: null
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await updateStaff(editing.id, form);
      } else {
        await addStaff({ id: \`staff-\${Date.now()}\`, ...form });
      }
      setDialogOpen(false);
    } catch (e) {
      alert("保存に失敗しました。データベースに必要なカラムが不足している可能性があります。");
    }
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
                <TableHead className="whitespace-nowrap">所属</TableHead>
                <TableHead className="whitespace-nowrap">運転区分</TableHead>
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
                  {s.unit_name && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-700 font-medium border-gray-200">
                      {s.unit_name}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.is_driver ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                      🚗 運転可能 (ドライバー)
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200">
                      添乗のみ (アシスタント)
                    </Badge>
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
              <Label>所属ユニット</Label>
              <Select
                value={form.unit_name || "ぽっけ"}
                onValueChange={(v) => {
                  setForm({ ...form, unit_name: v });
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ぽっけ">ぽっけ</SelectItem>
                  <SelectItem value="ぽっけⅡ">ぽっけⅡ</SelectItem>
                  <SelectItem value="日中一時">日中一時</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div 
              className={\`flex items-center gap-3 p-3 mt-4 rounded-lg border transition-colors duration-200 \${
                form.is_driver 
                  ? "bg-blue-50 border-blue-300 shadow-sm" 
                  : "bg-gray-50 border-gray-200"
              }\`}
            >
              <Switch
                id="is-driver"
                checked={form.is_driver}
                onCheckedChange={(v) => setForm({ ...form, is_driver: v })}
                className={form.is_driver ? "data-[state=checked]:bg-blue-600" : ""}
              />
              <Label 
                htmlFor="is-driver" 
                className={form.is_driver ? "text-blue-700 font-bold" : "text-gray-900 font-medium"}
              >
                運転可能 (ドライバー)
              </Label>
            </div>
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
`;

fs.writeFileSync('app/admin/staff/page.tsx', content);
console.log("Updated app/admin/staff/page.tsx");
