"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ColorDynamicFields } from "./ColorDynamicFields";
import {
  TAILWIND_COLORS,
  TAILWIND_SHADES,
  SPECIAL_COLORS,
  isValidTailwindColor,
  getColorPreview,
} from "@/utils/tailwindColors";

export type Category = "system" | "language" | "status";

export const colorSchema = z
  .object({
    color_value: z.string().refine(
      (val) => isValidTailwindColor(val),
      "Please select a valid Tailwind color"
    ),
    category: z.enum(["system", "language", "status"]),
    system_name: z.string().optional().nullable(),
    status_key: z.string().optional().nullable(),
    language_in: z.string().optional().nullable(),
    language_out: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.category === "system") {
        return data.system_name && data.system_name.trim().length > 0;
      }
      if (data.category === "status") {
        return data.status_key && data.status_key.trim().length > 0;
      }
      if (data.category === "language") {
        return (
          data.language_in &&
          data.language_in.trim().length > 0 &&
          data.language_out &&
          data.language_out.trim().length > 0
        );
      }
      return true;
    },
    {
      message: "Please fill in all required fields for the selected category",
      path: ["category"],
    }
  );

export type ColorFormValues = z.infer<typeof colorSchema>;

interface Props {
  editing:
    | (Partial<ColorFormValues> & { id?: number; setting_key?: string })
    | null;
  onDone: () => void;
  closeDialog: () => void;
}

export function ColorForm({ editing, onDone, closeDialog }: Props) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const form = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      color_value: "blue-500",
      category: "system",
      system_name: null,
      status_key: null,
      language_in: null,
      language_out: null,
      description: null,
    },
  });

  const isEdit = !!editing;

  useEffect(() => {
    if (editing) {
      form.reset({
        color_value: editing.color_value || "blue-500",
        category: editing.category || "system",
        system_name: editing.system_name ?? null,
        status_key: editing.status_key ?? null,
        language_in: editing.language_in ?? null,
        language_out: editing.language_out ?? null,
        description: editing.description ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function genKeyFromFields(values: Partial<ColorFormValues>) {
    if (!values.category) return "";
    let key = "";
    if (values.category === "system")
      key = `system_${(values.system_name || "").trim()}`;
    else if (values.category === "status")
      key = `status_${(values.status_key || "").trim()}`;
    else if (values.category === "language")
      key = `lang_${(values.language_in || "").trim()}_${(values.language_out || "").trim()}`;

    return key
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/__+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function buildDescription(values: Partial<ColorFormValues>): string | null {
    if (values.category === "system" && values.system_name?.trim()) {
      return `System: ${values.system_name.trim()}`;
    }
    if (values.category === "status" && values.status_key?.trim()) {
      return `Status: ${values.status_key.trim()}`;
    }
    if (
      values.category === "language" &&
      values.language_in?.trim() &&
      values.language_out?.trim()
    ) {
      return `Lang: ${values.language_in.trim()} -> ${values.language_out.trim()}`;
    }
    return null;
  }

  const onSubmit = async (values: ColorFormValues) => {
    const payload: Record<string, unknown> = {
      ...values,
      description: buildDescription(values),
      updated_at: new Date().toISOString(),
    };

    if (!isEdit) {
      payload.setting_key = genKeyFromFields(values);
      // null out fields not in category
      payload.system_name =
        values.category === "system" ? values.system_name : null;
      payload.status_key =
        values.category === "status" ? values.status_key : null;
      payload.language_in =
        values.category === "language" ? values.language_in : null;
      payload.language_out =
        values.category === "language" ? values.language_out : null;
    }

    try {
      if (isEdit && editing?.id) {
        const { error } = await supabase
          .from("color_settings")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Color updated successfully.");
      } else {
        const { error } = await supabase.from("color_settings").insert(payload);
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            toast.error("This color setting already exists.");
            return;
          }
          throw error;
        }
        toast.success("New color added.");
      }

      onDone();
      closeDialog();
    } catch (err) {
      console.error("save error", err);
      toast.error("Failed to save color setting.");
    }
  };

  const watchedColor = form.watch("color_value") ?? "blue-500";
  const selectedCategory = form.watch("category") ?? "system";

  // Parse current color value to get color name and shade
  const parseColorValue = (value: string) => {
    if (SPECIAL_COLORS.includes(value as "white" | "black" | "transparent")) {
      return { colorName: value, shade: "" };
    }
    const parts = value.split("-");
    if (parts.length === 2) {
      return { colorName: parts[0], shade: parts[1] };
    }
    return { colorName: "blue", shade: "500" };
  };

  const { colorName, shade } = parseColorValue(watchedColor);

  const handleColorChange = (newColorName: string) => {
    if (SPECIAL_COLORS.includes(newColorName as "white" | "black" | "transparent")) {
      form.setValue("color_value", newColorName);
    } else {
      const currentShade = shade || "500";
      form.setValue("color_value", `${newColorName}-${currentShade}`);
    }
  };

  const handleShadeChange = (newShade: string) => {
    if (!SPECIAL_COLORS.includes(colorName as "white" | "black" | "transparent")) {
      form.setValue("color_value", `${colorName}-${newShade}`);
    }
  };

  const isSpecialColor = SPECIAL_COLORS.includes(colorName as "white" | "black" | "transparent");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {!isEdit && (
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? "system"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="language">Language</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isEdit && (
          <ColorDynamicFields category={selectedCategory} form={form} />
        )}

        <FormField
          control={form.control}
          name="color_value"
          render={() => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <div className="space-y-3">
                {/* Color Name Selector */}
                <div className="flex items-center gap-3">
                  <Select value={colorName} onValueChange={handleColorChange}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {SPECIAL_COLORS.map((special) => (
                        <SelectItem key={special} value={special}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: getColorPreview(special) }}
                            />
                            <span className="capitalize">{special}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {TAILWIND_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded border"
                              style={{ backgroundColor: getColorPreview(`${color}-500`) }}
                            />
                            <span className="capitalize">{color}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Shade Selector - only show for non-special colors */}
                  {!isSpecialColor && (
                    <Select value={shade} onValueChange={handleShadeChange}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Shade" />
                      </SelectTrigger>
                      <SelectContent>
                        {TAILWIND_SHADES.map((s) => (
                          <SelectItem key={s} value={s}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded"
                                style={{ backgroundColor: getColorPreview(`${colorName}-${s}`) }}
                              />
                              <span>{s}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Color Preview */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-full h-10 rounded-md border shadow-sm flex items-center justify-center"
                    style={{ backgroundColor: getColorPreview(watchedColor) }}
                  >
                    <span 
                      className="text-xs font-mono px-2 py-1 rounded"
                      style={{ 
                        backgroundColor: "rgba(255,255,255,0.8)",
                        color: "#000"
                      }}
                    >
                      {watchedColor}
                    </span>
                  </div>
                </div>

                {/* Quick shade selector for non-special colors */}
                {!isSpecialColor && (
                  <div className="flex gap-1 flex-wrap">
                    {TAILWIND_SHADES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`w-6 h-6 rounded border transition-all ${
                          shade === s ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: getColorPreview(`${colorName}-${s}`) }}
                        onClick={() => handleShadeChange(s)}
                        title={`${colorName}-${s}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />


        <Button type="submit" className="w-full">
          {isEdit ? "Update Color" : "Add Color"}
        </Button>
      </form>
    </Form>
  );
}



