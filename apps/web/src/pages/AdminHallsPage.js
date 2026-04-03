import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { hallService } from '../services/hall.service';
const parsePositiveInt = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0)
        return null;
    return parsed;
};
export const AdminHallsPage = () => {
    const queryClient = useQueryClient();
    const { data: halls, isLoading, isError } = useQuery({
        queryKey: ['halls'],
        queryFn: () => hallService.list()
    });
    const [name, setName] = useState('');
    const [capacityText, setCapacityText] = useState('100');
    const [description, setDescription] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editCapacityText, setEditCapacityText] = useState('100');
    const [editDescription, setEditDescription] = useState('');
    const [editPhotoUrl, setEditPhotoUrl] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const validation = useMemo(() => {
        const errors = [];
        if (name.trim().length < 1)
            errors.push('Name is required.');
        if (name.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const capacity = parsePositiveInt(capacityText);
        if (capacity === null)
            errors.push('Capacity must be a positive integer.');
        if (capacity !== null && capacity > 5000)
            errors.push('Capacity must be 5000 or less.');
        return { errors, capacity };
    }, [name, capacityText]);
    const editValidation = useMemo(() => {
        const errors = [];
        if (editName.trim().length < 1)
            errors.push('Name is required.');
        if (editName.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const capacity = parsePositiveInt(editCapacityText);
        if (capacity === null)
            errors.push('Capacity must be a positive integer.');
        if (capacity !== null && capacity > 5000)
            errors.push('Capacity must be 5000 or less.');
        return { errors, capacity };
    }, [editName, editCapacityText]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0 || validation.capacity === null) {
                throw new Error(validation.errors[0] ?? 'Invalid form');
            }
            return hallService.create({
                name: name.trim(),
                capacity: validation.capacity,
                description: description.trim() ? description.trim() : undefined,
                photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
                isActive: true
            });
        },
        onSuccess: async () => {
            setName('');
            setCapacityText('100');
            setDescription('');
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => hallService.update(id, data),
        onSuccess: async () => {
            setEditingId(null);
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => hallService.remove(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const startEditing = (hall) => {
        setEditingId(hall.id);
        setEditName(hall.name);
        setEditCapacityText(hall.capacity.toString());
        setEditDescription(hall.description || '');
        setEditPhotoUrl(hall.photoUrl || '');
        setEditIsActive(hall.isActive);
    };
    const saveEdit = () => {
        if (!editingId || editValidation.errors.length > 0 || editValidation.capacity === null)
            return;
        updateMutation.mutate({
            id: editingId,
            data: {
                name: editName.trim(),
                capacity: editValidation.capacity,
                description: editDescription.trim() || undefined,
                photoUrl: editPhotoUrl.trim() ? editPhotoUrl.trim() : undefined,
                isActive: editIsActive
            }
        });
    };
    const cancelEdit = () => {
        setEditingId(null);
    };
    const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
    const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: "Halls" }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: "Create new hall" }), _jsxs("form", { onSubmit: (event) => {
                            event.preventDefault();
                            if (!canSubmit || createMutation.isPending)
                                return;
                            createMutation.mutate();
                        }, style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: ["Name", _jsx("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g., Main Hall" })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: ["Capacity", _jsx("input", { type: "number", min: 1, max: 5000, inputMode: "numeric", value: capacityText, onChange: (e) => setCapacityText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: ["Photo URL (Optional)", _jsx("input", { value: photoUrl, onChange: (e) => setPhotoUrl(e.target.value), placeholder: "https://example.com/image.jpg" })] }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: ["Description (Optional)", _jsx("input", { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? 'Creating...' : 'Create hall' }), validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create hall.' })) : null] })] })] }), isLoading ? _jsx("p", { children: "Loading halls..." }) : null, isError ? _jsx("p", { children: "Failed to load halls." }) : null, halls && (_jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12 }, children: [_jsx("h3", { children: "All Halls" }), halls.length === 0 ? (_jsx("p", { children: "No halls yet." })) : (_jsx("div", { style: { display: 'grid', gap: 12 }, children: halls.map((hall) => (_jsx("div", { style: {
                                border: '1px solid #eee',
                                padding: 12,
                                borderRadius: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }, children: editingId === hall.id ? (_jsxs("div", { style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: ["Name", _jsx("input", { value: editName, onChange: (e) => setEditName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: ["Capacity", _jsx("input", { type: "number", min: 1, max: 5000, value: editCapacityText, onChange: (e) => setEditCapacityText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: ["Description", _jsx("input", { value: editDescription, onChange: (e) => setEditDescription(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: ["Photo URL", _jsx("input", { value: editPhotoUrl, onChange: (e) => setEditPhotoUrl(e.target.value), placeholder: "https://example.com/image.jpg" })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: ["Active", _jsx("input", { type: "checkbox", checked: editIsActive, onChange: (e) => setEditIsActive(e.target.checked) })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: saveEdit, disabled: !canSaveEdit, style: { background: '#007bff', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: updateMutation.isPending ? 'Saving...' : 'Save' }), _jsx("button", { onClick: cancelEdit, style: { background: '#6c757d', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: "Cancel" })] }), editValidation.errors.length > 0 && (_jsx("div", { style: { gridColumn: '1 / -1', color: '#b00020', fontSize: '0.9em' }, children: editValidation.errors[0] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [hall.photoUrl ? (_jsx("img", { src: hall.photoUrl, alt: hall.name, style: { width: 80, height: 60, objectFit: 'cover', borderRadius: 4 } })) : null, _jsxs("div", { children: [_jsx("strong", { children: hall.name }), _jsxs("p", { style: { margin: '4px 0 0', fontSize: '0.9em', color: '#666' }, children: ["Capacity: ", hall.capacity, hall.description ? ` - ${hall.description}` : '', !hall.isActive && ' (Inactive)'] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => startEditing(hall), style: { background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: "Edit" }), _jsx("button", { onClick: () => deleteMutation.mutate(hall.id), disabled: deleteMutation.isPending, style: { background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: "Delete" })] })] })) }, hall.id))) }))] }))] }));
};
