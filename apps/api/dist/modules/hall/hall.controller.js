import { getPagination } from '../../utils/http.js';
import { HallRepository } from './hall.repository.js';
import { createHallSchema, hallIdSchema, updateHallSchema } from './hall.schema.js';
import { HallService } from './hall.service.js';
const hallService = new HallService(new HallRepository());
export class HallController {
    async list(request, response) {
        const pagination = getPagination(request);
        response.json(await hallService.listHalls(request.restaurantId, pagination));
    }
    async create(request, response) {
        const payload = createHallSchema.parse(request.body);
        response.status(201).json(await hallService.createHall(request.restaurantId, payload));
    }
    async update(request, response) {
        const { id } = hallIdSchema.parse(request.params);
        const payload = updateHallSchema.parse(request.body);
        response.json(await hallService.updateHall(request.restaurantId, id, payload));
    }
    async getById(request, response) {
        const { id } = hallIdSchema.parse(request.params);
        response.json(await hallService.getHallDetails(id));
    }
    async remove(request, response) {
        const { id } = hallIdSchema.parse(request.params);
        await hallService.deleteHall(id);
        response.status(204).send();
    }
}
