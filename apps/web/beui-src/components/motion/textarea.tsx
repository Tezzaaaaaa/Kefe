"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { value: valueProp, defaultValue, onChange, className, onFocus, onBlur, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.currentTarget.value);

  return (
    <motion.textarea
      ref={ref}
      value={valueProp}
      defaultValue={valueProp === undefined ? defaultValue : undefined}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      whileFocus={reduce ? undefined : { borderColor: "var(--shell-accent, var(--color-ring))" }}
      transition={{ duration: 0.16 }}
      className={cn(
        "beui-textarea-control block w-full min-w-0 resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
});
