terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "docuflow-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region"   { default = "us-east-1" }
variable "environment"  { default = "production" }
variable "db_password"  { sensitive = true }

# ─── NETWORKING ──────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "docuflow-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # HA: one per AZ

  tags = { Environment = var.environment, Product = "DocuFlow" }
}

# ─── EKS CLUSTER ─────────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.0.0"

  cluster_name    = "docuflow-${var.environment}"
  cluster_version = "1.29"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    # General workloads
    general = {
      min_size     = 2
      max_size     = 10
      desired_size = 3
      instance_types = ["m6i.xlarge"]
      labels = { role = "general" }
    }
    # AI workloads (more RAM)
    ai = {
      min_size     = 1
      max_size     = 5
      desired_size = 2
      instance_types = ["r6i.2xlarge"]
      labels = { role = "ai" }
      taints = [{ key = "ai-workload", value = "true", effect = "NO_SCHEDULE" }]
    }
  }
}

# ─── RDS POSTGRESQL ──────────────────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier        = "docuflow-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.2"
  instance_class    = "db.r7g.2xlarge"
  allocated_storage = 500
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "docuflow"
  username = "docuflow"
  password = var.db_password

  multi_az               = true
  backup_retention_period = 30
  deletion_protection    = true
  skip_final_snapshot    = false

  performance_insights_enabled = true
  monitoring_interval          = 60

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.docuflow.name

  tags = { Environment = var.environment }
}

# ─── ELASTICACHE REDIS ────────────────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "docuflow-${var.environment}"
  description          = "DocuFlow Redis cluster"

  node_type            = "cache.r7g.large"
  num_cache_clusters   = 3
  port                 = 6379

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name  = aws_elasticache_subnet_group.docuflow.name
  security_group_ids = [aws_security_group.redis.id]
}

# ─── S3 BUCKETS ──────────────────────────────────────────────
resource "aws_s3_bucket" "documents" {
  bucket = "docuflow-documents-${var.environment}"
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.docuflow.arn
    }
  }
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket                  = aws_s3_bucket.documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── KMS KEY ─────────────────────────────────────────────────
resource "aws_kms_key" "docuflow" {
  description             = "DocuFlow encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Environment = var.environment }
}

# ─── MSK (KAFKA) ─────────────────────────────────────────────
resource "aws_msk_cluster" "kafka" {
  cluster_name           = "docuflow-${var.environment}"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type  = "kafka.m5.large"
    client_subnets = module.vpc.private_subnets
    storage_info {
      ebs_storage_info {
        volume_size = 1000
      }
    }
  }

  encryption_info {
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }
}

# ─── OUTPUTS ─────────────────────────────────────────────────
output "eks_cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "rds_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "s3_bucket" {
  value = aws_s3_bucket.documents.bucket
}
