import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

@dataclass
class Job:
    job_id: str
    kind: str
    status: str = "queued"  # queued|running|done|error
    error: Optional[str] = None
    meta: dict = field(default_factory=dict)

class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}

    def create(self, kind: str, meta: Optional[dict] = None) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(job_id=job_id, kind=kind, meta=meta or {})
        self.jobs[job_id] = job
        return job

    def set_status(self, job_id: str, status: str, error: Optional[str] = None):
        job = self.jobs.get(job_id)
        if not job:
            return
        job.status = status
        job.error = error

