import { Router } from 'express';
import * as roomController from '../controllers/roomController';

export const roomRoutes = Router();

roomRoutes.post('/create', roomController.createRoom);
roomRoutes.post('/join', roomController.joinRoom);