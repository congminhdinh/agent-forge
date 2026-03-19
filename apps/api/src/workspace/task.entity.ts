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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AgentRun, (run) => run.task)
  runs!: AgentRun[];
}
