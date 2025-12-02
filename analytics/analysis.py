import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../.env')

# Database Connection
DB_USER = os.getenv('RDS_USERNAME', 'ella_admin')
DB_PASS = os.getenv('RDS_PASSWORD', 'ella_password')
DB_HOST = os.getenv('RDS_HOSTNAME', 'localhost')
DB_PORT = os.getenv('RDS_PORT', '5434')
DB_NAME = os.getenv('RDS_DB_NAME', 'ella_rises')

# Create SQLAlchemy Engine
connection_string = f'postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
engine = create_engine(connection_string)

def generate_charts():
    print("Connecting to database...")
    try:
        # 1. Fetch Data: Survey Results joined with Event Types
        query_surveys = """
            SELECT 
                s.satisfaction_score, 
                s.self_confidence_rating, 
                et.event_type 
            FROM survey s
            JOIN registration r ON s.registration_id = r.registration_id
            JOIN event_occurrence eo ON r.occurrence_id = eo.occurrence_id
            JOIN event_template et ON eo.template_id = et.template_id
        """
        df_surveys = pd.read_sql(query_surveys, engine)
        
        if not df_surveys.empty:
            # Chart 1: Average Satisfaction by Event Type
            plt.figure(figsize=(10, 6))
            sns.barplot(x='event_type', y='satisfaction_score', data=df_surveys, ci=None, palette='viridis')
            plt.title('Average Satisfaction by Event Type')
            plt.ylabel('Satisfaction Score (1-5)')
            plt.xlabel('Event Type')
            plt.savefig('../public/img/analytics/satisfaction_by_type.png')
            print("Generated: satisfaction_by_type.png")
            plt.close()

            # Chart 2: Self Confidence Distribution
            plt.figure(figsize=(10, 6))
            sns.histplot(df_surveys['self_confidence_rating'], bins=5, kde=True, color='skyblue')
            plt.title('Distribution of Self Confidence Ratings')
            plt.xlabel('Rating (1-5)')
            plt.savefig('../public/img/analytics/confidence_dist.png')
            print("Generated: confidence_dist.png")
            plt.close()
        else:
            print("No survey data found to generate charts.")

        # 2. Fetch Data: Participant Demographics
        query_participants = "SELECT generation_status, household_income_bracket FROM participant"
        df_participants = pd.read_sql(query_participants, engine)

        if not df_participants.empty:
            # Chart 3: Generation Status Count
            plt.figure(figsize=(8, 8))
            df_participants['generation_status'].value_counts().plot.pie(autopct='%1.1f%%', startangle=90, colors=['#ff9999','#66b3ff','#99ff99'])
            plt.title('Participant Generation Status')
            plt.ylabel('')
            plt.savefig('../public/img/analytics/generation_pie.png')
            print("Generated: generation_pie.png")
            plt.close()
        else:
            print("No participant data found.")

        print("Analysis Complete. Charts saved to public/img/analytics/")

    except Exception as e:
        print(f"Error during analysis: {e}")

if __name__ == "__main__":
    generate_charts()
