from dataclasses import dataclass
from typing import ClassVar
from pydantic import BaseModel
from typing import Optional
from typing import Any
import pandas as pd

@dataclass
class Date:
    year: int
    month: int
    day: int

@dataclass
class DateTime(Date):
    hour: int
    minute: int
    second: int
    millisecond: int = 0

@dataclass
class Task:
    task_id: int = None
    title: str = None
    description: str = None
    link_to_taskmanager: str = None
    due_date: Date = None
    closed_dttm: DateTime = None
    created_at: DateTime = None
    task_status: int = None
    _nullables: ClassVar[dict] = {
        'title': 'NOT NULL',
        'created_at': 'NOT NULL'
    }
    _defaults: ClassVar[dict] = {
        'task_id': "nextval('task_id_sequence')",
        'created_at': 'CURRENT_TIMESTAMP'
    }
    _sequences: ClassVar[list] = [
        'task_id_sequence START 1'
    ]
    def df_row_to_task(row):
        task = Task()
        task.task_id = row['task_id']
        return task

class CreateTaskDTO(BaseModel):
    title: str
    description: Optional[str] = None
    link_to_taskmanager: Optional[str] = None
    due_date: str
    task_status: Optional[int] = None

class UpdateTaskDTO(BaseModel):
    task_id: int
    title: str = None
    description: Optional[str] = None
    link_to_taskmanager: Optional[str] = None
    due_date: str = None
    closed_date: Optional[str] = None
    task_status: Optional[int] = None

@dataclass
class TaskStatus:
    status_id: int = None
    status_name: str = None
    _nullables: ClassVar[dict] = {
        'status_name': 'UNIQUE'
    }
    _defaults: ClassVar[dict] = {
        'status_id': "nextval('task_status_id_sequence')"
    }
    _sequences: ClassVar[list] = [
        'task_status_id_sequence START 1'
    ]

def convert_class_to_sql_type(cls: any):
    type_map = {
        str: 'VARCHAR',
        int: 'INTEGER',
        Date: 'DATE',
        DateTime: 'TIMESTAMP',
        float: 'FLOAT8'
    }
    return type_map.get(cls)

def get_sql_table(cls: any):
        """:returns [0]:list[str]: список атрибутов таблицы sql в create-формате
        :returns [1]:list[str]: список требуемых sequence для создания таблицы"""
        
        _d = vars(cls)
        d = {}
        for k,v in _d.items():
            if not k.startswith('_') and not callable(v):
                d[k] = v
        table_create_attrs = []
        for attr,v in d.items():
            attr_type = cls.__annotations__.get(attr)
            default = _d["_defaults"].get(attr, '')
            if default != '':
                default = f'DEFAULT {default}'
            table_create_attrs.append(f'"{attr}" {convert_class_to_sql_type(attr_type)} {_d["_nullables"].get(attr, "NULL")} {default}')
        sq = _d.get("_sequences")
        return table_create_attrs, sq

def _df_to_list_of_obj(df: pd.DataFrame, cls: Any) -> list[Any]:
    attribs = [
        attr for attr, value in vars(cls).items()
        if not attr.startswith('_') and not callable(value)
    ]
    missing = set(attribs) - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame missing columns: {missing}")
    if not attribs:
        return [cls() for _ in range(len(df))]
    cols = [df[attr] for attr in attribs]
    return [cls(**dict(zip(attribs, row))) for row in zip(*cols)]