"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:     "bg-leasy-accent text-leasy-dark hover:brightness-105 shadow-sm",
        outline:     "border-leasy-border bg-white text-leasy-dark hover:bg-leasy-bg",
        secondary:   "bg-leasy-bg text-leasy-dark hover:bg-leasy-border",
        ghost:       "hover:bg-leasy-bg text-leasy-muted hover:text-leasy-dark",
        destructive: "bg-red-50 text-red-600 hover:bg-red-100",
        link:        "text-leasy-dark underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-4",
        xs:      "h-6 gap-1 px-2 text-xs rounded-full [&_svg:not([class*='size-'])]:size-3",
        sm:      "h-7 gap-1 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg:      "h-11 gap-2 px-6 text-base",
        icon:    "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
