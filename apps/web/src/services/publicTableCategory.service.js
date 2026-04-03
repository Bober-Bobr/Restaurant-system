import axios from 'axios';
const publicTableCategoriesUrl = () => {
    const apiRoot = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');
    return `${apiRoot}/public/table-categories`;
};
export const publicTableCategoryService = {
    async listActive() {
        const { data } = await axios.get(publicTableCategoriesUrl());
        return data;
    }
};
