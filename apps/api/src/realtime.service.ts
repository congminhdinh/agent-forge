import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

type RealtimeEnvelope = {
  type: string;
  data: Record<string, unknown>;
  at: string;
};

@Injectable()
export class RealtimeService {
  private readonly channels = new Map<string, Subject<MessageEvent>>();

  streamProject(projectId: string): Observable<MessageEvent> {
    return this.ensureChannel(`project:${projectId}`).asObservable();
  }

  streamTask(taskId: string): Observable<MessageEvent> {
    return this.ensureChannel(`task:${taskId}`).asObservable();
  }

  streamUsage(userId: string): Observable<MessageEvent> {
    return this.ensureChannel(`usage:${userId}`).asObservable();
  }

  streamNotifications(userId: string): Observable<MessageEvent> {
    return this.ensureChannel(`notifications:${userId}`).asObservable();
  }

  emitProject(projectId: string, type: string, data: Record<string, unknown>) {
    this.emit(`project:${projectId}`, type, data);
  }

  emitTask(taskId: string, type: string, data: Record<string, unknown>) {
    this.emit(`task:${taskId}`, type, data);
  }

  emitUsage(userId: string, type: string, data: Record<string, unknown>) {
    this.emit(`usage:${userId}`, type, data);
  }

  emitNotifications(userId: string, type: string, data: Record<string, unknown>) {
    this.emit(`notifications:${userId}`, type, data);
  }

  private emit(channel: string, type: string, data: Record<string, unknown>) {
    this.ensureChannel(channel).next({
      data: {
        type,
        data,
        at: new Date().toISOString(),
      } satisfies RealtimeEnvelope,
    });
  }

  private ensureChannel(channel: string) {
    const existing = this.channels.get(channel);
    if (existing) {
      return existing;
    }

    const created = new Subject<MessageEvent>();
    this.channels.set(channel, created);
    return created;
  }
}
