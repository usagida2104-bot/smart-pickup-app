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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MOCK_CHILDREN, MOCK_SCHOOLS } from "@/lib/mockData";
import { Child } from "@/types";

const unitOptions = ["ぽっけ", "ぽっけ2", "その他"];

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>(MOCK_CHILDREN);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Child | null>(null);

  const defaultForm = {
    name: "",
    school_id: "",
    unit_name: "ぽっけ",
    has_caution: false,
    notes: "",
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
      unit_name: child.unit_name ?? "ぽっけ",
      has_caution: child.has_caution,
      notes: child.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const school = MOCK_SCHOOLS.find((s) => s.id === form.school_id) ?? null;
    if (editing) {
      setChildren((prev) =>
        prev.map((c) =>
          c.id === editing.id
            ? { ...c, ...form, school }
            : c
        )
      );
    } else {
      const newChild: Child = {
        id: `child-${Date.now()}`,
        name: form.name,
        school_id: form.school_id || null,
        unit_name: form.unit_name || null,
        has_caution: form.has_caution,
        notes: form.notes || null,
        school,
      };
      setChildren((prev) => [...prev, newChild]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (child: Child) => {
    setChildren((prev) => prev.filter((c) => c.id !== child.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">児童管理</h1>
          <p className="text-sm text-gray-500 mt-1">登録児童数: {children.length}名</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          児童を追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>名前</TableHead>
              <TableHead>学校</TableHead>
              <TableHead>ユニット</TableHead>
              <TableHead>配慮事項</TableHead>
              <TableHead>メモ</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {children.map((child) => (
              <TableRow key={child.id} className="hover:bg-gray-50">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {child.has_caution && (
                      <span className="text-red-500 text-xs">❤️</span>
                    )}
                    {child.name}
                  </div>
                </TableCell>
                <TableCell>
                  {child.school ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: child.school.color_code ?? "#ccc" }}
                      />
                      <span className="text-sm">{child.school.name}</span>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">未設定</span>
                  )}
                </TableCell>
                <TableCell>
                  {child.unit_name ? (
                    <Badge variant="secondary">{child.unit_name}</Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">─</span>
                  )}
                </TableCell>
                <TableCell>
                  {child.has_caution ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" />
                      あり
                    </Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">なし</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                  {child.notes ?? "─"}
                </TableCell>
                <TableCell className="text-right">
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
                  {MOCK_SCHOOLS.map((s) => (
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
            <div className="flex items-center gap-3">
              <Switch
                id="has-caution"
                checked={form.has_caution}
                onCheckedChange={(v) => setForm({ ...form, has_caution: v })}
              />
              <Label htmlFor="has-caution">配慮事項あり（❤️マーク）</Label>
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
            <Button onClick={handleSave} disabled={!form.name.trim()}>
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
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
