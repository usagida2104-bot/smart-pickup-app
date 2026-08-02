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
import { School } from "@/types";
import { useMasterStore } from "@/lib/store/masterStore";

const COLOR_PRESETS = [
  "#F87171", "#FB923C", "#FBBF24", "#34D399",
  "#60A5FA", "#818CF8", "#E879F9", "#94A3B8",
];

export default function SchoolsPage() {
  const { schools, addSchool, updateSchool, deleteSchool } = useMasterStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [form, setForm] = useState({ name: "", color_code: "#60A5FA", area: "", address: "" });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", color_code: "#60A5FA", area: "", address: "" });
    setDialogOpen(true);
  };

  const openEdit = (school: School) => {
    setEditing(school);
    setForm({ 
      name: school.name, 
      color_code: school.color_code ?? "#60A5FA", 
      area: school.area ?? "",
      address: school.address ?? ""
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateSchool(editing.id, form);
    } else {
      addSchool({ id: `school-${Date.now()}`, ...form });
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">学校管理</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">登録校数: {schools.length}校</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          学校を追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">カラー</TableHead>
              <TableHead className="whitespace-nowrap">学校名</TableHead>
              <TableHead className="whitespace-nowrap">エリア</TableHead>
              <TableHead className="whitespace-nowrap">住所</TableHead>
              <TableHead className="text-right whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school) => (
              <TableRow key={school.id}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg shadow-sm border border-white/50"
                      style={{ backgroundColor: school.color_code ?? "#ccc" }}
                    />
                    <code className="text-xs text-gray-500">{school.color_code}</code>
                  </div>
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{school.name}</TableCell>
                <TableCell className="text-gray-500 whitespace-nowrap">{school.area || "未設定"}</TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-nowrap">{school.address || "未設定"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
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
              <Label htmlFor="school-area">エリア（グループ名）</Label>
              <Input
                id="school-area"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="北エリア、中央グループなど"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="school-address">住所</Label>
              <Input
                id="school-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="宮城県仙台市青葉区..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>マグネットカラー</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 shadow-sm border ${
                      form.color_code === color ? "ring-2 ring-offset-2 ring-blue-600 scale-110 border-transparent" : "border-gray-200"
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
          <DialogHeader>
            <DialogTitle>削除の確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> を削除してよろしいですか？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteTarget) deleteSchool(deleteTarget.id);
              setDeleteTarget(null);
            }}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
