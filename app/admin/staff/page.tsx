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
import { MOCK_STAFF } from "@/lib/mockData";
import { Staff } from "@/types";

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>(MOCK_STAFF);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: "", is_driver: true });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", is_driver: true });
    setDialogOpen(true);
  };

  const openEdit = (s: Staff) => {
    setEditing(s);
    setForm({ name: s.name, is_driver: s.is_driver });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      setStaff((prev) =>
        prev.map((s) => s.id === editing.id ? { ...s, ...form } : s)
      );
    } else {
      setStaff((prev) => [...prev, { id: `staff-${Date.now()}`, ...form }]);
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">スタッフ管理</h1>
          <p className="text-sm text-gray-500 mt-1">登録スタッフ数: {staff.length}名</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          スタッフを追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>名前</TableHead>
              <TableHead>ドライバー</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  {s.is_driver ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">
                      🚗 ドライバー
                    </Badge>
                  ) : (
                    <Badge variant="secondary">アシスタント</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
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
            <div className="flex items-center gap-3">
              <Switch
                id="is-driver"
                checked={form.is_driver}
                onCheckedChange={(v) => setForm({ ...form, is_driver: v })}
              />
              <Label htmlFor="is-driver">ドライバー権限あり</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
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
              setStaff((prev) => prev.filter((s) => s.id !== deleteTarget?.id));
              setDeleteTarget(null);
            }}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
