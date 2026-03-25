import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Project, (project) => project.user)
  projects!: Project[];

  @OneToMany(() => ApiKeySetting, (apiKey) => apiKey.user)
  apiKeys!: ApiKeySetting[];
}