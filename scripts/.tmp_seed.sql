
USE [SMS];
SET NOCOUNT ON;
DELETE FROM dbo.ClosedPostPosition WHERE CreatedBy = 'ArchivedReport_BulkSeed_9000';
DELETE FROM dbo.PostPosition WHERE CreatedBy = 'ArchivedReport_BulkSeed_9000';
SELECT @@ROWCOUNT;
