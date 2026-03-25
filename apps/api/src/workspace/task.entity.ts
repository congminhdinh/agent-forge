import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentRun } from '../agent/agent-run.entity';
import { Project } from './project.entity';
import { AgentRole } from './role.entity';

@Entity('tasks')
export class TaskItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, (project) => project.tasks, { onDelete: 'CASCADE' })
  project!: Project;

  @Column()
  title!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ default: 'backlog' })
  status!: string;

  @Column({ type: 'int', default: 2 })
  priority!: number;

  @ManyToOne(() => AgentRole, (role) => role.tasks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  assignedRole!: AgentRole | null;

  @Column({ type: 'varchar', nullable: true })
  modelOverride!: string | null;

  @Column({ type: 'text', nullable: true })
  latestSummary!: string | null;

  @Column({ type: 'text', nullable: true })
  reviewFeedback!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewRequestedRoleSlug!: string | null;

  @Column({ type: 'varchar', nullable: true })
  githubBranch!: string | null;

  @Column({ type: 'int', nullable: true })
  githubPrNumber!: number | null;

  @Column({ type: 'varchar', nullable: true })
  githubPrUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  githubStatus!: string | null;

  @Column({ type: 'text', nullable: true })
  githubStatusReason!: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'int', default: 2 })
  maxRetries!: number;

  @Column({ default: 'healthy' })
  recoveryState!: string;

  @Column({ type: 'text', nullable: true })
  lastFailureReason!: string | null;

  @Column({ type: 'datetime', nullable: true })
  deadLetteredAt!: Date | null;

  @Column({ type: 'simple-json', default: '[]' })
  messages!: Array<Record<string, unknown>>;

  @Column({ type: 'simple-json', default: '[]' })
  reviews!: Array<Record<string, unknown>>;

  @Column({ type: 'simple-json', default: '[]' })
  transitions!: Array<Record<string, unknown>>;

  @Column({ type: 'simple-json', default: '[]' })
  runHistory!: Array<Record<string, unknown>>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AgentRun, (run) => run.task)
  runs!: AgentRun[];
}
