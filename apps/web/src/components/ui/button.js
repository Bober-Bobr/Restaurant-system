import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef } from 'react';
import { cn } from '../../lib/utils';
const variantClasses = {
    default: 'adm-btn-primary',
    secondary: 'adm-btn-ghost',
    accent: 'adm-btn-primary',
    destructive: 'adm-btn-danger',
    ghost: 'adm-btn-ghost',
    outline: 'adm-btn-ghost',
};
const sizeStyles = {
    default: '',
    sm: 'adm-btn-sm',
    lg: 'adm-btn-lg',
};
export const Button = forwardRef(({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (_jsx("button", { ref: ref, type: type, className: cn(variantClasses[variant], sizeStyles[size], className), ...props }));
});
Button.displayName = 'Button';
