import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
export const Card = ({ className, ...props }) => (_jsx("div", { className: cn('card overflow-hidden', className), ...props }));
