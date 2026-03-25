import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationRecord } from '../notifications/notification.entity';
import { ApiKeySetting } from '../settings/api-key-setting.entity';
import { Project } from '../workspace/project.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  displayName!: string;

  @Column({ default: 'dev' })
  authProvider!: string;

  @Column({ type: 'varchar', nullable: true })
  externalId!: string | null;

  @Column({ default: 'pro' })
  subscriptionTier!: string;

  @Column({ default: 'active' })
  subscriptionStatus!: string;

  @Column({ type: 'int', default: 5 })
  maxConcurrentSessions!: number;

  @Column({ type: 'int', default: 50 })
  maxWeeklyTasks!: number;

  @Column({ default: false })
  isAdmin!: boolean;

  @Column({ default: false })
  onboardingCompleted!: boolean;

  @Column({ type: 'varchar', nullable: true })
  notificationEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  notificationWebhookUrl!: string | null;

  @Column({ default: false })
  emailNotificationsEnabled!: boolean;

  @Column({ default: false })
  webhookNotificationsEnabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Project, (project) => project.user)
  projects!: Project[];

  @OneToMany(() => ApiKeySetting, (apiKey) => apiKey.user)
  apiKeys!: ApiKeySetting[];

  @OneToMany(() => NotificationRecord, (notification) => notification.user)
  notifications!: NotificationRecord[];
}
