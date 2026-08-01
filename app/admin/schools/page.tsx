"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MOCK_SCHOOLS } from "@/lib/mockData";
import { School } from "@/types";

const COLOR_PRESETS = [
  "#F87171", "#FB923C", "#FBBF24", "#34D399",
  "#60A5FA", "#818CF8", "#E879F9", "#94A3B8",
];

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>(MOCK_SCHOOLS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [form, setForm] = useState({ name: "", color_code: "#60A5FA" });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", color_code: "#60A5FA" });
    setDialogOpen(true);
  };

  const openEdit = (school: School) => {
    setEditing(school);
    setForm({ name: school.name, color_code: school.color_code ?? "#60A5FA" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      setSchools((prev) =>
        prev.map((s) => s.id === editing.id ? { ...s, ...form } : s)
      );
    } else {
      setSchools((prev) => [
        ...prev,
        { id: `school-${Date.now()}`, ...form },
      ]);
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">学校管理</h1>
          <p className="text-sm text-gray-500 mt-1">登録校数: {schools.length}校</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          学校を追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>カラー</TableHead>
              <TableHead>学校名</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school) => (
              <TableRow key={school.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg shadow-sm border border-white/50"
                      style={{ backgroundColor: school.color_code ?? "#ccc" }}
                    />
                    <code className="text-xs text-gray-500">{school.color_code}</code>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(school)}>
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(school)}>
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
            <DialogTitle>{editing ? "学校を編集" : "学校を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="school-name">学校名 *</Label>
              <Input
                id="school-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="〇〇小学校"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>マグネットカラー</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${
                      form.color_code === color ? "ring-2 ring-offset-2 ring-gray-800 scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm({ ...form, color_code: color })}
                  />
                ))}
              </div>
              <Input
                value={form.color_code}
                onChange={(e) => setForm({ ...form, color_code: e.target.value })}
                className="mt-2"
                placeholder="#RRGGBB"
              />
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
          <DialogHeader>
            <DialogTitle>削除の確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> を削除してよろしいですか？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => {
              setSchools((prev) => prev.filter((s) => s.id !== deleteTarget?.id));
              setDeleteTarget(null);
            }}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
