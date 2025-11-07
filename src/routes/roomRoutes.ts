import { Elysia, t } from 'elysia';
import * as roomController from '../controllers/roomController';

export const roomRoutes = new Elysia({ prefix: '/api/room' })
  .post('/create', roomController.createRoom, {
    body: t.Object({
      theme: t.String()
    })
  })
  .post('/join', roomController.joinRoom, {
    body: t.Object({
      code: t.String()
    })
  });