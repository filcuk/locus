import sqlalchemy
import pandas as pd

dbEngine=sqlalchemy.create_engine('sqlite:////home/stephen/db1.db')
pd.read_sql('select * from test',dbEngine)
pd.df_todb.to_sql(name = 'newTable',con= dbEngine, index=False, if_exists='replace')