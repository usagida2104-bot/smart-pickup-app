"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { useMasterStore } from "@/lib/store/masterStore";
import { Vehicle } from "@/types";

const vehicleTypeLabels: Record<string, string> = {
  minivan: "ミニバン",
  compact: "コンパクト",
  "k-car": "軽自動車",
};

export default function VehiclesPage() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle } = useMasterStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const defaultForm = { name: "", capacity: 4, vehicle_type: "compact" as Vehicle["vehicle_type"] };
  const [form, setForm] = useState(defaultForm);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setForm({ name: v.name, capacity: v.capacity, vehicle_type: v.vehicle_type });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      updateVehicle(editing.id, form);
    } else {
      addVehicle({ id: `vehicle-${Date.now()}`, ...form });
    }
    setDialogOpen(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">車両管理</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">登録車両数: {vehicles.length}台</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          車両を追加
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">車両名</TableHead>
              <TableHead className="whitespace-nowrap">種別</TableHead>
              <TableHead className="whitespace-nowrap">定員（ドライバー除く）</TableHead>
              <TableHead className="text-right whitespace-nowrap">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium whitespace-nowrap">{v.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline">
                    {vehicleTypeLabels[v.vehicle_type ?? ""] ?? v.vehicle_type}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: v.capacity }).map((_, i) => (
                        <div key={i} className="w-4 h-4 rounded-sm bg-blue-200" />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{v.capacity}名</span>
                  </div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(v)}>
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
            <DialogTitle>{editing ? "車両を編集" : "車両を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="vehicle-name">車両名 *</Label>
              <Input
                id="vehicle-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ステップワゴン"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>種別</Label>
              <Select
                value={form.vehicle_type ?? "compact"}
                onValueChange={(v) => setForm({ ...form, vehicle_type: v as Vehicle["vehicle_type"] })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minivan">ミニバン</SelectItem>
                  <SelectItem value="compact">コンパクト</SelectItem>
                  <SelectItem value="k-car">軽自動車</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="vehicle-capacity">定員（ドライバー除く）</Label>
              <Input
                id="vehicle-capacity"
                type="number"
                min={1}
                max={15}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                className="mt-1.5"
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
          <DialogHeader><DialogTitle>削除の確認</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{deleteTarget?.name}</strong> を削除してよろしいですか？
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={() => {
              if (deleteTarget) deleteVehicle(deleteTarget.id);
              setDeleteTarget(null);
            }}>削除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
