import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'accent' | 'destructive' | 'ghost' | 'outline';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'default' | 'sm' | 'lg';
};

const variantClasses: Record<ButtonVariant, string> = {
  default: 'adm-btn-primary',
  secondary: 'adm-btn-ghost',
  accent: 'adm-btn-primary',
  destructive: 'adm-btn-danger',
  ghost: 'adm-btn-ghost',
  outline: 'adm-btn-ghost',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  default: '',
  sm: 'adm-btn-sm',
  lg: 'adm-btn-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(variantClasses[variant], sizeStyles[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
