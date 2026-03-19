import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { AgentRole } from './role.entity';
import { TaskItem } from './task.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.projects, { onDelete: 'CASCADE' })
  user!: User;

  @Column()
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  githubRepo!: string | null;

  @Column({ default: 'agentforge/' })
  githubBranchPrefix!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AgentRole, (role) => role.project)
  roles!: AgentRole[];

  @OneToMany(() => TaskItem, (task) => task.project)
  tasks!: TaskItem[];
}
