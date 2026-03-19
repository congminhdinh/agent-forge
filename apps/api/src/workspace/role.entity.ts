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
import { TaskItem } from './task.entity';

@Entity('agent_roles')
export class AgentRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, (project) => project.roles, { onDelete: 'CASCADE' })
  project!: Project;

  @Column()
  slug!: string;

  @Column()
  displayName!: string;

  @Column({ type: 'text' })
  systemPromptTemplate!: string;

  @Column()
  modelPreference!: string;

  @Column({ type: 'simple-json', default: '[]' })
  toolAccessPolicy!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => TaskItem, (task) => task.assignedRole)
  tasks!: TaskItem[];

  @OneToMany(() => AgentRun, (run) => run.role)
  runs!: AgentRun[];
}
