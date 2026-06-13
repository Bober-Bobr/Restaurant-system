import type { Request, Response } from 'express';
import { ReviewRepository } from './review.repository.js';
import { createReviewSchema, setApprovedSchema } from './review.schema.js';

const repo = new ReviewRepository();

export class ReviewController {
  // Public: submit a review (unapproved by default).
  async create(request: Request, response: Response) {
    const data = createReviewSchema.parse(request.body);
    const review = await repo.create({
      restaurantId: data.restaurantId,
      authorName: data.authorName.trim(),
      rating: data.rating,
      text: data.text?.trim() || null,
      photoUrl: data.photoUrl?.trim() || null,
    });
    response.status(201).json({ id: review.id });
  }

  // Public: list approved reviews for a restaurant.
  async listApproved(request: Request, response: Response) {
    const restaurantId = String(request.query.restaurantId ?? '').trim();
    if (!restaurantId) { response.json([]); return; }
    response.json(await repo.listApproved(restaurantId));
  }

  // Manager/Chief: list all reviews for a restaurant.
  async listAll(request: Request, response: Response) {
    const restaurantId = String(request.query.restaurantId ?? '').trim();
    if (!restaurantId) { response.status(400).json({ message: 'restaurantId required' }); return; }
    response.json(await repo.listAll(restaurantId));
  }

  async setApproved(request: Request, response: Response) {
    const { isApproved } = setApprovedSchema.parse(request.body);
    const updated = await repo.setApproved(String(request.params.id), isApproved);
    response.json(updated);
  }

  async remove(request: Request, response: Response) {
    await repo.delete(String(request.params.id));
    response.status(204).send();
  }
}
