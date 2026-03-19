import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaskItem } from '../workspace/task.entity';
import { AgentRole } from '../workspace/role.entity';

@Entity('agent_runs')
export class AgentRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => TaskItem, (task) => task.runs, { onDelete: 'CASCADE' })
  task!: TaskItem;

  @ManyToOne(() => AgentRole, (role) => role.runs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  role!: AgentRole | null;

  @Column({ default: 'running' })
  status!: string;

  @Column()
  provider!: string;

  @Column()
  model!: string;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ type: 'text', default: '' })
  rawOutput!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'simple-json', default: '[]' })
  filesChanged!: string[];

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
