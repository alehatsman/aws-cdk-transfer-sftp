import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as iam from '@aws-cdk/aws-iam'
import * as transfer from '@aws-cdk/aws-transfer'

export class AwsCdkTransferSftpStack extends cdk.Stack {
  constructor (scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Bucket for storing SFTP files
    const bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true
    })

    // Vpc for the SFTP server
    const vpc = new ec2.Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 3
    })

    // Security group for the SFTP server
    const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allows frp access to transfer server'
    })

    const users = [{
      username: 'username',
      subfolder: 'subfolder',
      ip: '127.0.0.1/32',
      sshPublicKeys: [
        'ssh-rsa ...'
      ]
    }]

    // Allow ssh access to the SFTP server for users by adding public ip addesses
    // to the security group
    users.forEach(user => {
      sg.addIngressRule(
        ec2.Peer.ipv4(user.ip),
        ec2.Port.tcp(22),
        'Allow ssh(22) inbound access'
      )
    })

    // Logging role for the SFTP server, allows to log to CloudWatch
    const loggingRole = new iam.Role(this, 'LoggingRole', {
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com')
    })

    loggingRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSTransferLoggingAccess'
      )
    )

    const publicSubnetIds = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC
    }).subnetIds

    const eips = vpc.selectSubnets({
      onePerAz: true
    }).subnets.map((_, x) => {
      return new ec2.CfnEIP(this, `EIP${x}`)
    })

    const transferServer = new transfer.CfnServer(this, 'TransferServer', {
      endpointDetails: {
        vpcId: vpc.vpcId,
        subnetIds: publicSubnetIds,
        securityGroupIds: [sg.securityGroupId],
        addressAllocationIds: eips.map(eip => eip.attrAllocationId)
      },
      endpointType: 'VPC',
      identityProviderType: 'SERVICE_MANAGED',
      loggingRole: loggingRole.roleArn,
      protocols: ['SFTP'],
      securityPolicyName: 'TransferSecurityPolicy-2020-06'
    })

    users.forEach(user => {
      new TransferUser(this, user.username, {
        transferServer,
        bucket,
        ...user
      })
    })
  }
}

interface TransferUserProps {
  transferServer: transfer.CfnServer
  bucket: s3.Bucket
  subfolder: string
  username: string
  sshPublicKeys: string[]
}

export class TransferUser extends cdk.Construct {
  public transferUser: transfer.CfnUser

  constructor (scope: cdk.Construct, id: string, props: TransferUserProps) {
    super(scope, id)

    const {
      transferServer,
      bucket,
      subfolder,
      username,
      sshPublicKeys
    } = props

    const transferRole = new iam.Role(this, 'TransferRole', {
      assumedBy: new iam.ServicePrincipal('transfer.amazonaws.com')
    })

    transferRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [bucket.bucketArn]
    }))

    transferRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject',
        's3:GetObjectVersion'
      ],
      resources: [bucket.arnForObjects(`${subfolder}/*`)]
    }))

    const transferUser = new transfer.CfnUser(this, 'TransferUser', {
      userName: username,
      homeDirectory: `/${bucket.bucketName}/${subfolder}`,
      homeDirectoryType: 'PATH',
      role: transferRole.roleArn,
      serverId: transferServer.attrServerId,
      sshPublicKeys: sshPublicKeys
    })
  }
}
