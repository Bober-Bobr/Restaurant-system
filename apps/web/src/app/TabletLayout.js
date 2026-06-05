import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { stopTabletMusic } from '../utils/tabletMusic';
export const TabletLayout = () => {
    useEffect(() => {
        return () => { stopTabletMusic(); };
    }, []);
    return _jsx(Outlet, {});
};
