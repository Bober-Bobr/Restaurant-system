import { AdminRole } from '@prisma/client';
import { RestaurantRepository } from './restaurant.repository.js';
import { createRestaurantSchema, updateRestaurantSchema } from './restaurant.schema.js';
import { RestaurantService } from './restaurant.service.js';
const service = new RestaurantService(new RestaurantRepository());
export class RestaurantController {
    async list(request, response) {
        const admin = request.admin;
        if (admin.role === AdminRole.CHIEF_ADMIN) {
            response.json(await service.listAll());
            return;
        }
        if (admin.role === AdminRole.OWNER) {
            response.json(await service.listForOwner(admin.id));
            return;
        }
        if (admin.restaurantId) {
            response.json(await service.listForStaff(admin.restaurantId));
            return;
        }
        // JWT stale — look up from DB
        const fromDb = await service.listForStaffByUserId(admin.id);
        if (fromDb.length > 0) {
            response.json(fromDb);
            return;
        }
        // No restaurant assigned yet — return all so ADMIN can select one for new employees
        response.json(await service.listAll());
    }
    async create(request, response) {
        const data = createRestaurantSchema.parse(request.body);
        const restaurant = await service.create(request.admin.id, data);
        response.status(201).json(restaurant);
    }
    async update(request, response) {
        const data = updateRestaurantSchema.parse(request.body);
        const admin = request.admin;
        const restaurant = admin.role === AdminRole.CHIEF_ADMIN
            ? await service.updateAsChief(String(request.params.id), data)
            : await service.update(admin.id, String(request.params.id), data);
        response.json(restaurant);
    }
    async remove(request, response) {
        const admin = request.admin;
        if (admin.role === AdminRole.CHIEF_ADMIN) {
            await service.removeAsChief(String(request.params.id));
        }
        else {
            await service.remove(admin.id, String(request.params.id));
        }
        response.status(204).send();
    }
}
