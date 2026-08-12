import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

const TEXT = { type: 'nvarchar', length: 'MAX' } as const;

@Entity('projects')
export class ProjectEntity {
  @PrimaryColumn('int') id!: number;
  @Column() priority!: string;
  @Column() name!: string;
  @Column() location!: string;
  @Column() typeOfWork!: string;
  @Column() contractType!: string;
  @Column() contractAmt!: string;
  @Column() estStart!: string;
  @Column() duration!: string;
  @Column(TEXT) scope!: string;
  @Column() stage!: string;
  @Column('int') progress!: number;
  @Column({ nullable: true }) referral!: string;
  @Column() contactedBy!: string;
  @Column() imgColor!: string;
  @Column(TEXT) img!: string;
}

@Entity('people')
export class PersonEntity {
  @PrimaryColumn('int') id!: number;
  @Column() name!: string;
  @Column() role!: string;
  @Column() company!: string;
  @Column({ nullable: true }) contact!: string | null;
  @Column() kind!: string;
  @Column() tier!: string;
  @Column() phone!: string;
  @Column() email!: string;
  @Column('simple-json') projects!: string[];
  @Column('int') openTasks!: number;
  @Column() since!: string;
  @Column({ type: 'simple-json', nullable: true }) comply!: unknown;
  @Column() last!: string;
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryColumn() id!: string;
  @Column() tab!: string; // internal | owner | subcontractor
  @Column() meetingType!: string;
  @Column() meetingDate!: string;
  @Column({ nullable: true }) assignedTo!: string;
  @Column() status!: string;
  @Column({ nullable: true }) originator!: string;
  @Column() topicType!: string;
  @Column(TEXT) description!: string;
  @Column({ nullable: true }) dueDate!: string;
  @Column({ nullable: true }) dateClosed!: string;
  @Column('int') daysOpen!: number;
  @Column({ type: 'nvarchar', length: 'MAX', nullable: true }) resolution!: string;
  @Column({ nullable: true }) linkedFile!: string;
  @Column() project!: string;
}

@Entity('deals')
export class DealEntity {
  @PrimaryColumn() id!: string;
  @Column() name!: string;
  @Column() client!: string;
  @Column() value!: string;
  @Column() stage!: string;
  @Column('int') stageIdx!: number;
  @Column() assignedRole!: string;
  @Column() assignee!: string;
  @Column() assigneeInit!: string;
  @Column('int') daysInStage!: number;
  @Column() nextAction!: string;
  @Column() nextDue!: string;
  @Column() source!: string;
  @Column() status!: string;
  @Column() phone!: string;
  @Column() email!: string;
  @Column('simple-json') timeline!: unknown[];
  @Column(TEXT) notes!: string;
}

@Entity('invoices')
export class InvoiceEntity {
  @PrimaryGeneratedColumn() pk!: number;
  @Column() invId!: string;
  @Column() kind!: string; // internal | client | consultant
  @Column() project!: string;
  @Column() month!: string;
  @Column() issued!: string;
  @Column('int') amount!: number;
  @Column('int') paid!: number;
}

@Entity('finance')
export class FinanceEntity {
  @PrimaryColumn() name!: string;
  @Column() exec!: string;
  @Column() contract!: string;
  @Column() labor!: string;
  @Column() phase!: string;
  @Column('int') base!: number;
  @Column('int') co!: number;
  @Column('int') reimb!: number;
  @Column('int') baseUsed!: number;
  @Column('int') coUsed!: number;
  @Column('int') reimbUsed!: number;
  @Column('int') timePct!: number;
}
