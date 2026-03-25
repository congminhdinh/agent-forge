import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notifications')
export class NotificationRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  user!: User;

  @Column()
  kind!: string;

  @Column({ default: 'in_app' })
  channel!: string;

  @Column({ default: 'info' })
  level!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', nullable: true })
  taskId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  projectId!: string | null;

  @Column({ default: 'sent' })
  status!: string;

  @Column({ type: 'varchar', nullable: true })
  destination!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
